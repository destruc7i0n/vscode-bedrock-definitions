import * as vscode from 'vscode'

import FileSearcher from '../lib/FileSearcher'

import { FileType } from '../handlers/FileHandler'

import { getCompletionItem, getDocumentLink } from '../lib/util'

/* Credit to https://github.com/Arcensoth/language-mcfunction for regex */
const rc = '[a-z0-9_\.\-]+'
const resourceId = `(?:(${rc})\:)?`
const resource = `((?:\/?${rc})*)`
/* * */

const resourceLocation = `${resourceId}${resource}`
const functionPathMatch = `functions/${resource}.mcfunction`

const commandPrefixes = {
  [FileType.McFunction]: 'function',
  [FileType.Particle]: 'particle',
  [FileType.ServerEntityIdentifier]: 'summon',
}

const supportedCalls = [
  { type: FileType.McFunction },
  { type: FileType.Particle },
  { type: FileType.ServerEntityIdentifier },
]

type SupportedCallTypes = FileType.McFunction | FileType.Particle | FileType.ServerEntityIdentifier

interface ResourceType {
  [key: string]: vscode.Range[]
}

class CommandHandler {
  private document: vscode.TextDocument

  constructor (document: vscode.TextDocument) {
    this.document = document
  }

  /**
   * Get all document links from the document
   * @param searcher the file searcher
   */
  public async getLinks (searcher: FileSearcher) {
    let links: vscode.DocumentLink[] = []

    for (let { type: callType } of supportedCalls) {
      const calls = this.getCallsFromDocument(callType as SupportedCallTypes)
      let typeLinks: vscode.DocumentLink[] = []

      if (Object.keys(calls).length) {
        switch (callType) {
          case FileType.McFunction: {
            typeLinks = await this.getFunctionLinksFromCalls(calls)
            break
          }
          case FileType.Particle:
          case FileType.ServerEntityIdentifier: {
            typeLinks = await this.getLinksFromFilesSearch(calls, searcher, callType)
            break
          }
          default: break
        }
      }

      links = links.concat(typeLinks)
    }

    return links
  }

  public async getCompletionItems (position: vscode.Position, searcher: FileSearcher) {
    let completionItems: vscode.CompletionItem[] = []

    const line = this.document.lineAt(position.line)

    for (let { type: callType } of supportedCalls) {
      const call = this.extractCallFromLine(line, callType as SupportedCallTypes, line.lineNumber)

      if (!call) continue
      
      const { range, id } = call

      let items: string[] = []

      switch (callType) {
        case FileType.McFunction: {
          items = await this.getFunctionsFromPath(id)
          break
        }
        case FileType.Particle:
        case FileType.ServerEntityIdentifier: {
          ({ identifiers: items } = await searcher.findByType(callType))
          break
        }
        default: break
      }

      completionItems = completionItems.concat(
        items.map(item => getCompletionItem(item, range))
      )
    }

    return completionItems
  }

  /**
   * Get all calls of type in the document into an object
   * @param type type of call to search for
   */
  private getCallsFromDocument (type: SupportedCallTypes): ResourceType {
    let calls: ResourceType = {}

    for (let i = 0; i < this.document.lineCount; i++) {
      const line = this.document.lineAt(i)
      const call = this.extractCallFromLine(line, type, i)
      if (call) {
        const { id, range } = call
        if (!calls[id]) calls[id] = []
        calls[id].push(range)
      }
    }

    return calls
  }

  public extractCallFromLine (line: vscode.TextLine, type: SupportedCallTypes, lineNumber: number) {
    const commandName = commandPrefixes[type]
    // ignore comments
    const lineContent = line.text.substring(line.firstNonWhitespaceCharacterIndex, line.text.length)
    if (lineContent.startsWith('#') || lineContent.startsWith('//') || lineContent.startsWith('*')) return

    const regex = new RegExp(`${commandName} ${resourceLocation}`)
    const match = line.text.match(regex)

    if (match && match.length === 3 && match.index !== undefined) {
      const [ command, namespace, resource ] = match

      let id = resource

      switch (type) {
        case FileType.McFunction: {
          if (namespace) return // do not handle java functions
          break
        }
        case FileType.ServerEntityIdentifier:
        case FileType.Particle: {
          id = `${namespace}:${resource}`
          break
        }
        default: break
      }

      const range = this.getRangeFromLine(commandName, id, match.index, lineNumber)

      return { range, id }
    }
  }

  public async getFunctionsFromPath (functionPath: string) {
    const glob = `**/functions/${functionPath}/**/*.mcfunction`
    const found = await vscode.workspace.findFiles(glob)

    let files: string[] = []

    files = found.map((file) => {
      const filePath = file.path

      // remove everything leading up to here
      const functionDirectoryPath = filePath.substring(filePath.indexOf(functionPath)).replace('.mcfunction', '')
      return functionDirectoryPath
    })

    return files
  } 

  /**
   * Get all function links from the calls
   * @param calls The calls to find
   */
  private async getFunctionLinksFromCalls (calls: ResourceType): Promise<vscode.DocumentLink[]> {
    let links: vscode.DocumentLink[] = []

    let files = Object.keys(calls)
    files = files.filter((f, index) => files.indexOf(f) === index) // remove duplicates

    // bulk glob
    const glob = `**/functions/{${files.map(f => `${f}.mcfunction`).join(',')}}`
    const found = await vscode.workspace.findFiles(glob)

    const fileMatch = new RegExp(functionPathMatch)

    for (let foundFile of found) {
      // get the original function path from the file
      const matchedPath = foundFile.path.match(fileMatch)
      if (matchedPath && matchedPath.length === 2) {
        const functionPath = matchedPath[1]
        // check that the resource is being used
        if (calls[functionPath]) {
          for (let resourceRange of calls[functionPath]) {
            links.push(getDocumentLink(foundFile, resourceRange))
          }
        }
      }
    }

    return links
  }

  /**
   * Get all links from the calls based on the file type
   * @param calls the calls
   * @param searcher the file searcher
   * @param type the type of file to search
   */
  private async getLinksFromFilesSearch (calls: ResourceType, searcher: FileSearcher, type: FileType) {
    const links: vscode.DocumentLink[] = []

    for (let resourceId of Object.keys(calls)) {
      const file = await searcher.findByIndentifier(type, resourceId)

      if (file) {
        for (let resourceRange of calls[resourceId]) {
          links.push(getDocumentLink(file.uri, resourceRange))
        }
      }
    }

    return links
  }

  /**
   * Returns the range of the resource
   * @param prefix the string prefixing the call
   * @param resource the resource called
   * @param startIndex the starting index
   * @param lineNumber the line number
   */
  private getRangeFromLine (prefix: string, resource: string, startIndex: number, lineNumber: number) {
    const start = startIndex + `${prefix} `.length
    const end = start + resource.length

    return new vscode.Range(
      new vscode.Position(lineNumber, start),
      new vscode.Position(lineNumber, end)
    )
  }
}

export default CommandHandler

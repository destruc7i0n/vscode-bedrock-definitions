import * as vscode from 'vscode'

import FileSearcher from './FileHandler'

import { FileType } from '../handlers/FileHandler'

import { getCompletionItem, getDocumentLink } from '../lib/util'
import LineParser, { Usage, UsageData, RESOURCE } from '../lib/LineParser'

type SupportedCallTypes = FileType.McFunction | FileType.Particle | FileType.ServerEntityIdentifier

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

    const usages = this.getCallTypesFromDocument()

    for (let [ type, usage ] of usages) {
      let typeLinks: vscode.DocumentLink[] = []
      if (usage.size) {
        switch (type) {
          case FileType.McFunction: {
            typeLinks = await this.getFunctionLinksFromCalls(usage)
            break
          }
          case FileType.Particle:
          case FileType.ServerEntityIdentifier: {
            typeLinks = await this.getLinksFromFilesSearch(usage, searcher, type)
            break
          }
          default: break
        }
      }
      links = links.concat(typeLinks)
    }

    return links
  }

  /**
   * Get completion items for the current position in the document
   * @param position position in the document
   * @param searcher file searcher
   */
  public async getCompletionItems (position: vscode.Position, searcher: FileSearcher) {
    let completionItems: vscode.CompletionItem[] = []

    const line = this.document.lineAt(position.line)
    const lineParser = new LineParser(line, position.character)

    for (let [ type, uses ] of lineParser.usages) {
      if (!uses.size) continue

      for (let [ id, ranges ] of uses) {
        for (let { range } of ranges) {
          let identifiers: string[] = []

          switch (type) {
            case FileType.McFunction: {
              identifiers = await this.getFunctionsFromPath(id)
              break
            }
            case FileType.Particle:
            case FileType.ServerEntityIdentifier: {
              const data = await searcher.getIdentifiersByFileType(type)
              identifiers = [ ...data.keys() ]
              break
            }
            default: break
          }

          completionItems = completionItems.concat(
            identifiers.map(id => getCompletionItem(id, range))
          )
        }
      }
    }

    return completionItems
  }

  /**
   * Get all the call types from the document
   */
  private getCallTypesFromDocument () {
    const usages: Usage = new Map()

    for (let num = 0; num < this.document.lineCount; num++) {
      const line = this.document.lineAt(num)
      const lineParser = new LineParser(line)
      for (let [ type, uses ] of lineParser.usages) {
        if (!usages.has(type)) usages.set(type, new Map())
        const typeUsages = usages.get(type)!
        for (let [ identifier, ranges ] of uses) {
          typeUsages.set(identifier, [
            ...(typeUsages.get(identifier) || []),
            ...ranges
          ])
        }
      }
    }

    return usages
  }

  /**
   * Lists all functions from a specified path
   * @param functionPath path to list functions from
   */
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
   * @param usages The calls to find
   */
  private async getFunctionLinksFromCalls (usages: UsageData): Promise<vscode.DocumentLink[]> {
    let links: vscode.DocumentLink[] = []

    let filePaths = [ ...usages.keys() ]
    filePaths = filePaths.filter((f, index) => filePaths.indexOf(f) === index) // remove duplicates

    // bulk glob
    const glob = `**/functions/{${filePaths.map(f => `${f}.mcfunction`).join(',')}}`
    const found = await vscode.workspace.findFiles(glob)

    const fileMatch = new RegExp(`functions/${RESOURCE}.mcfunction`)

    for (let foundFile of found) {
      // get the original function path from the file
      const matchedPath = foundFile.path.match(fileMatch)
      if (matchedPath && matchedPath.length === 2) {
        const functionPath = matchedPath[1]
        // check that the resource is being used
        if (usages.has(functionPath)) {
          for (let { range } of usages.get(functionPath)!) {
            links.push(getDocumentLink(foundFile, range, this.getTooltip(FileType.McFunction)))
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
  private async getLinksFromFilesSearch (calls: UsageData, searcher: FileSearcher, type: SupportedCallTypes) {
    const links: vscode.DocumentLink[] = []

    for (let [ resourceId, usages ] of calls) {
      const file = await searcher.findByIndentifier(type, resourceId)

      if (file) {
        for (let { range } of usages)
          links.push(getDocumentLink(file.uri, range, this.getTooltip(type)))
      }
    }

    return links
  }

  /**
   * Get tooltip for link
   * @param type tooltip type
   */
  private getTooltip (type: SupportedCallTypes) {
    const name = {
      [FileType.McFunction]: 'function',
      [FileType.ServerEntityIdentifier]: 'entity',
      [FileType.Particle]: 'particle',
    }[type]
    return `Go to ${name} definition`
  }
}

export default CommandHandler

import * as vscode from 'vscode'

import FileSearcher from './FileHandler'

import { FileType } from '../handlers/FileHandler'

import LineParser, { SupportedResources, Usage, UsageData, MCFUNCTION_PATH_MATCH } from '../lib/LineParser'
import { getCompletionItem, getDocumentLink } from '../lib/util'
import VanillaEntities from '../lib/defaults'

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

    const usages = this.getResourceUsagesFromDocument()

    for (let [ type, usage ] of usages) {
      let typeLinks: vscode.DocumentLink[] = []
      if (usage.size) {
        switch (type) {
          case FileType.McFunction: {
            typeLinks = await this.getFunctionLinksFromUsages(usage)
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
    const lineParser = new LineParser(line)
    const cursorUsage = lineParser.getUsageAtCursorPosition(position)

    if (cursorUsage) {
      const { type, content, range } = cursorUsage

      let identifiers: string[] = []

      switch (type) {
        case FileType.McFunction: {
          identifiers = await this.getFunctionsFromPath(content)
          break
        }
        case FileType.SoundEffect:
        case FileType.Particle:
        case FileType.ServerEntityIdentifier: {
          const data = await searcher.getIdentifiersByFileType(type)
          identifiers = [ ...data.keys() ]
          break
        }
        default: break
      }

      // attempt to link to entities which are overwritten
      if (type === FileType.ServerEntityIdentifier) {
        // merge entities with the default ones
        identifiers = [
          ...new Set([
            ...identifiers.map(id => id.replace('minecraft:', '')),
            ...VanillaEntities,
          ])
        ]
      }

      completionItems = completionItems.concat(
        identifiers.map(id => getCompletionItem(id, range))
      )
    }

    return completionItems
  }

  /**
   * Get all the usages of resources in the document
   */
  private getResourceUsagesFromDocument () {
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
    let id = functionPath
    let glob = ''

    if (id.includes('/')) {
      // remove the final forward slash if any
      if (id.endsWith('/')) id = id.substring(0, id.length - 1)
      // search using this as a prefix
      glob = `**/functions/${id}/**/*.mcfunction`
    } else {
      // a search by partial name
      glob = `**/functions/**/${id}*.mcfunction`
    }

    const found = await vscode.workspace.findFiles(glob)

    let files: string[] = []

    for (let foundFile of found) {
      const filePath = foundFile.path
      const matchedPath = filePath.match(MCFUNCTION_PATH_MATCH)
      if (matchedPath && matchedPath.length === 2) files.push(matchedPath[1])
    }

    return files
  } 

  /**
   * Get all function links from the calls
   * @param usages The calls to find
   */
  private async getFunctionLinksFromUsages (usages: UsageData): Promise<vscode.DocumentLink[]> {
    let links: vscode.DocumentLink[] = []

    let filePaths = [ ...usages.keys() ]
    filePaths = filePaths.filter((f, index) => filePaths.indexOf(f) === index) // remove duplicates

    // bulk glob
    const glob = `**/functions/{${filePaths.map(f => `${f}.mcfunction`).join(',')}}`
    const found = await vscode.workspace.findFiles(glob)

    for (let foundFile of found) {
      // get the original function path from the file
      const matchedPath = foundFile.path.match(MCFUNCTION_PATH_MATCH)
      if (matchedPath && matchedPath.length === 2) {
        const functionPath = matchedPath[1]
        // check that the resource is being used
        if (usages.has(functionPath)) {
          for (let { range, link } of usages.get(functionPath)!) {
            if (link) links.push(getDocumentLink(foundFile, range, this.getTooltip(FileType.McFunction)))
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
  private async getLinksFromFilesSearch (calls: UsageData, searcher: FileSearcher, type: SupportedResources) {
    const links: vscode.DocumentLink[] = []

    for (let [ resourceId, usages ] of calls) {
      // if there is no namespace, assume vanilla entity
      if (resourceId.split(':').length === 1) resourceId = `minecraft:${resourceId}`

      const file = await searcher.findByIndentifier(type, resourceId)

      if (file) {
        for (let { range, link } of usages)
          if (link) links.push(getDocumentLink(file.uri, range, this.getTooltip(type)))
      }
    }

    return links
  }

  /**
   * Get tooltip for link
   * @param type tooltip type
   */
  private getTooltip (type: SupportedResources) {
    const name = {
      [FileType.McFunction]: 'function',
      [FileType.ServerEntityIdentifier]: 'entity',
      [FileType.Particle]: 'particle',
      [FileType.SoundEffect]: 'sound',
    }[type]
    return `Go to ${name} definition`
  }
}

export default CommandHandler

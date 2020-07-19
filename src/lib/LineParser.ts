import * as vscode from 'vscode'

import { Data, FileType, RangeInfo } from '../handlers/FileHandler'

import { getRangeFromLine } from '../lib/util'

/* Credit to https://github.com/Arcensoth/language-mcfunction for regex */
export const RESOURCE_CHARS = '[a-z0-9_\.\-]+'
export const RESOURCE_ID = `(?:(${RESOURCE_CHARS})\:)?`
export const RESOURCE = `((?:\/?${RESOURCE_CHARS})*)`
/* * */

const RESOURCE_LOCATION = `${RESOURCE_ID}${RESOURCE}`

const selectorRegex = `@[a-z](?:\\[([^ ]*)(?:\\]|$))?`

export type Usage = Map<SupportedResources, UsageData>
export type UsageData = Data<RangeInfo[]>

type SupportedResources = FileType.McFunction | FileType.Particle | FileType.ServerEntityIdentifier
type SupportedUsageType = { type: SupportedResources, prefix: string, re: string }

class LineParser {
  line: vscode.TextLine
  lineContent: string

  usages: Usage = new Map()

  supportedCommands: SupportedUsageType[] = [
    { type: FileType.McFunction, prefix: 'function', re: RESOURCE_LOCATION },
    { type: FileType.Particle, prefix: 'particle', re: RESOURCE_LOCATION },
    { type: FileType.ServerEntityIdentifier, prefix: 'summon', re: RESOURCE_LOCATION },
  ]

  supportedSelectors: SupportedUsageType[] = [
    { type: FileType.ServerEntityIdentifier, prefix: 'type', re: RESOURCE_LOCATION }
  ]

  constructor (line: vscode.TextLine, character?: number) {
    this.line = line
    this.lineContent = line.text.substring(line.firstNonWhitespaceCharacterIndex, character || line.text.length)

    if (this.isValidLine()) {
      this.usages = this.extractCommandCalls()
      if (character) this.extractSelectors()
    }
  }

  /**
   * Verify that the line is not a comment of sorts
   */
  private isValidLine () {
    return !(this.lineContent.startsWith('#') || this.lineContent.startsWith('//') || this.lineContent.startsWith('*'))
  }

  /**
   * Extract all call types from the line
   * @param line the line of the document to be extracted
   * @param call the call to search for
   * @param lineNumber the current line number
   */
  private extractCommandCalls (): Usage {
    let calls: Usage = new Map()

    for (let supportedCommand of this.supportedCommands) {
      const { prefix: command, re, type } = supportedCommand

      // init map
      if (!calls.has(type)) calls.set(type, new Map())
      let entries = calls.get(type)!

      const regex = new RegExp(`${command} ${re}`)
      const matches = this.lineContent.matchAll(regex)

      for (let match of matches) {
        if (match && match.length === 3 && match.index !== undefined) {
          const [ _command, namespace, resource ] = match
  
          let id = resource
    
          switch (type) {
            case FileType.McFunction: {
              if (namespace) return calls // do not handle java functions
              break
            }
            case FileType.ServerEntityIdentifier:
            case FileType.Particle: {
              id = namespace ? `${namespace}:${resource}` : resource
              break
            }
            default: break
          }
    
          const range = getRangeFromLine(command, id, match.index, this.line.lineNumber)
    
          entries.set(id, [
            ...(entries.get(id) || []),
            { range }
          ])
        }
      }
    }

    return calls
  }

  /**
   * Extract selectors from the current line
   */
  private extractSelectors () {
    // todo
  }
}

export default LineParser

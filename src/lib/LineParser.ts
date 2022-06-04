import * as vscode from 'vscode'

import { Data, DataType, FileType } from '../handlers/FileHandler'
import { removeEndingQuote } from './util'

/* Credit to https://github.com/Arcensoth/language-mcfunction for some regex */
const IDENTIFIER = /[a-z0-9_\.\-]+/
const RESOURCE_ID = new RegExp(`((?:${IDENTIFIER.source}):?(?:${IDENTIFIER.source})*)`)
export const FILE_LOCATION = /([\w\.\-\/]+)/
export const ANIMATION_MATCH = /(animation\.[\w\.\-]+)/
export const MCFUNCTION_PATH_MATCH = new RegExp(`functions/${FILE_LOCATION.source}.mcfunction`)

const SELECTOR_ARGUMENTS_REGEX = /(?<=@[a-z]\[)(?:([^\]]*))?(?=\]|$)/g
const SELECTOR_REGEX_NO_GROUP = /@(?:initiator|[a-z])(?:\[[^\]]*\])?/g

const LOCATION_REGEX = /(?:[\~\^](?:\-?\d*\.?\d+)? *){3}/

export type Usage = Map<SupportedTypes, UsageData>
export type UsageData = Data<LineInfo[]>
export type LineInfo = { range: vscode.Range, link: boolean }

export type SupportedTypes =
  FileType.McFunction |
  FileType.Particle |
  FileType.ServerEntityIdentifier |
  FileType.SoundEffect |
  FileType.Animation |
  FileType.Dialogue |
  DataType.ServerEntityEvents
type SupportedUsageType = { type: SupportedTypes, prefix?: string, regex: RegExp[], link: boolean }

// an extremely simple line parser, will need to be rewritten in the future
class LineParser {
  private line: vscode.TextLine
  private lineContent: string
  private lineStartIndex: number

  usages: Usage = new Map()

  private supportedCommands: SupportedUsageType[] = [
    {
      type: FileType.McFunction,
      regex: [new RegExp(`function ${FILE_LOCATION.source}`, 'g')],
      link: true
    },
    {
      type: FileType.Particle,
      regex: [new RegExp(`particle ${RESOURCE_ID.source}`, 'g')],
      link: true
    },
    {
      type: DataType.ServerEntityEvents,
      regex: [new RegExp(`event entity ${SELECTOR_REGEX_NO_GROUP.source} ${RESOURCE_ID.source}`, 'g')],
      link: true
    },
    {
      type: FileType.ServerEntityIdentifier,
      regex: [new RegExp(`summon ${RESOURCE_ID.source}`, 'g')],
      link: true
    },
    {
      type: FileType.Animation,
      regex: [new RegExp(`playanimation ${SELECTOR_REGEX_NO_GROUP.source} ${ANIMATION_MATCH.source}`, 'g')],
      link: true
    },
    {
      type: FileType.Dialogue,
      regex: [
        new RegExp(`dialogue open ${SELECTOR_REGEX_NO_GROUP.source} ${SELECTOR_REGEX_NO_GROUP.source} (${IDENTIFIER.source})`, 'g'),
        new RegExp(`dialogue change ${SELECTOR_REGEX_NO_GROUP.source} (${IDENTIFIER.source})`, 'g')
      ],
      link: true
    },
    // sound definitions
    {
      type: FileType.SoundEffect,
      regex: [
        new RegExp(`playsound ${RESOURCE_ID.source}`, 'g'),
        new RegExp(`stopsound ${SELECTOR_REGEX_NO_GROUP.source} ${RESOURCE_ID.source}`, 'g')
      ],
      link: false
    },
  ]

  private supportedSelectors: SupportedUsageType[] = [
    { type: FileType.ServerEntityIdentifier, prefix: 'type', regex: [RESOURCE_ID], link: false }
  ]

  constructor (line: vscode.TextLine) {
    this.line = line
    this.lineContent = line.text.substring(line.firstNonWhitespaceCharacterIndex, line.text.length)

    this.lineStartIndex = line.firstNonWhitespaceCharacterIndex

    if (this.isValidLine()) {
      this.extractCommandCalls()
      this.extractSelectors()
    }
  }

  /**
   * Find usage on the line that is where the cursor is at
   * @param cursorPosition the position of the cursor
   */
  public getUsageAtCursorPosition (cursorPosition: vscode.Position) {
    for (let [ type, usages ] of this.usages) {
      for (let [ content, ranges ] of usages) {
        for (let { range } of ranges) {
          if (range.contains(cursorPosition)) {
            const rangeUntilCursor = range.with({ 
              end: new vscode.Position(
                range.end.line,
                // don't go past the cursor
                Math.min(range.end.character, cursorPosition.character)
              )
            })
            return {
              content,
              range: rangeUntilCursor,
              type,
            }
          }
        }
      }
    }
  }

  /**
   * Verify that the line is not a comment of sorts
   */
  private isValidLine () {
    return !(this.lineContent.startsWith('#') || this.lineContent.startsWith('//') || this.lineContent.startsWith('*'))
  }

  /**
   * Extract all command usages from the line
   * @param line the line of the document to be extracted
   * @param call the call to search for
   * @param lineNumber the current line number
   */
  private extractCommandCalls () {
    for (let supportedCommand of this.supportedCommands) {
      const { type } = supportedCommand

      for (let regex of supportedCommand.regex) {
        // init map
        if (!this.usages.has(type)) this.usages.set(type, new Map())
        let entries = this.usages.get(type)!

        const matches = this.lineContent.matchAll(regex)

        for (let match of matches) {
          if (match && match.length === 2 && match.index !== undefined) {
            let [ command, id ] = match

            // remove the id from the command to get the index where the resource is used
            const commandPrefix = command.replace(id, '')

            // the index of the start of the command, and the length of the command before the resource
            const start = this.lineStartIndex + match.index + commandPrefix.length
            const range = new vscode.Range(
              new vscode.Position(this.line.lineNumber, start),
              new vscode.Position(this.line.lineNumber, start + id.length)
            )

            entries.set(id, [
              ...(entries.get(id) || []),
              { range, link: supportedCommand.link }
            ])
          }
        }
      }
    }
  }

  /**
   * Extract selectors from the current line
   */
  private extractSelectors () {
    const selectorMatches = this.lineContent.matchAll(SELECTOR_ARGUMENTS_REGEX)
    for (let match of selectorMatches) {
      let selectorText = match[1]

      if (selectorText) {
        // remove a trailing quote if any, from a json file
        selectorText = removeEndingQuote(selectorText)
        this.parseSelector(selectorText, 0, match.index!)
      }
    }
  }

  /**
   * Simple parser to extract and check the KV pairs in the selector
   * @param input the inside of the selector
   * @param index the index to start at in the input
   * @param startIndex the starting index in the entire line
   */
  private parseSelector (input: string, index: number, startIndex: number) {
    // base
    if (index > input.length || input.charAt(index) === ']') return

    // get the key
    let key = ''
    while (index < input.length && input.charAt(index) !== '=') {
      key += input.charAt(index)
      index++
    }

    // remove any spaces around
    const trimmedKey = key.trim()

    // account for the "="
    index++

    // string starting index + current index + index that the selector is starting
    let valueStartIndex = this.lineStartIndex + index + startIndex
    let value = ''
    // while not at the end of a key
    if (trimmedKey === 'scores' || trimmedKey === 'hasitem') {
      index++ // the first curly bracket
      while (index < input.length && input.charAt(index) !== '}') {
        value += input.charAt(index)
        index++
      }
      index++ // the second curly bracket
    } else {
      // wait until next param
      while (index < input.length && input.charAt(index) !== ',') {
        value += input.charAt(index)
        index++
      }
    }

    // remove any spaces around
    let trimmedValue = value.trim()
    let valueLength = value.length

    // ingore negation characters
    if (trimmedValue.charAt(0) === '!') {
      trimmedValue = trimmedValue.substring(1)
      valueStartIndex += 1
      valueLength -= 1
    }

    // construct the range from the position
    const valueRange = new vscode.Range(
      new vscode.Position(this.line.lineNumber, valueStartIndex),
      new vscode.Position(this.line.lineNumber, valueStartIndex + valueLength)
    )

    selectorLoop:
    for (let { type, prefix, link, regex } of this.supportedSelectors) {
      if (prefix === key) {
        // verify that the value matches the regex
        for (let re of regex) {
          if(trimmedValue.length > 0 && !re.test(trimmedValue)) continue selectorLoop
        }

        if (!this.usages.has(type)) this.usages.set(type, new Map())
        let entries = this.usages.get(type)!
        entries.set(trimmedValue, [
          ...(entries.get(trimmedValue) || []),
          { range: valueRange, link }
        ])
      }
    }

    // begin next argument
    this.parseSelector(input, index + 1, startIndex)
  }
}

export default LineParser

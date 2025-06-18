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

export type LineInfo = { range: vscode.Range, link: boolean }

export type SupportedTypes =
  FileType.McFunction |
  FileType.Particle |
  FileType.ServerEntityIdentifier |
  FileType.SoundEffect |
  FileType.Animation |
  FileType.Dialogue |
  DataType.ServerEntityEvents

type SupportedUsageType = { 
  type: SupportedTypes
  prefix?: string
  regex: RegExp[]
  link: boolean
}

class UsageEntry {
  constructor(
    public type: SupportedTypes,
    public content: string,
    public ranges: LineInfo[]
  ) {}

  addRange(range: vscode.Range, link: boolean) {
    this.ranges.push({ range, link })
  }

  containsPosition(position: vscode.Position): LineInfo | undefined {
    return this.ranges.find(({ range }) => range.contains(position))
  }
}

class UsageStore {
  private entries: UsageEntry[] = []
  private index: Map<string, UsageEntry[]> = new Map()

  add(type: SupportedTypes, content: string, range: vscode.Range, link: boolean) {
    const key = `${type}:${content}`
    let entryList = this.index.get(key)
    
    if (!entryList) {
      entryList = []
      this.index.set(key, entryList)
    }

    let entry = entryList.find(e => e.type === type && e.content === content)
    if (!entry) {
      entry = new UsageEntry(type, content, [])
      entryList.push(entry)
      this.entries.push(entry)
    }

    entry.addRange(range, link)
  }

  getAtPosition(position: vscode.Position) {
    for (const entry of this.entries) {
      const info = entry.containsPosition(position)
      if (info) {
        const rangeUntilCursor = info.range.with({ 
          end: new vscode.Position(
            info.range.end.line,
            Math.min(info.range.end.character, position.character)
          )
        })
        return {
          content: entry.content,
          range: rangeUntilCursor,
          type: entry.type,
        }
      }
    }
    return undefined
  }

  // For compatibility with existing code
  toMap(): Map<SupportedTypes, Data<LineInfo[]>> {
    const result = new Map<SupportedTypes, Data<LineInfo[]>>()
    
    for (const entry of this.entries) {
      let typeMap = result.get(entry.type)
      if (!typeMap) {
        typeMap = new Map()
        result.set(entry.type, typeMap)
      }
      typeMap.set(entry.content, entry.ranges)
    }
    
    return result
  }
}

// Pre-compiled regex patterns for better performance
const COMMAND_PATTERNS: SupportedUsageType[] = [
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
    link: false
  },
  {
    type: FileType.ServerEntityIdentifier,
    regex: [new RegExp(`summon ${RESOURCE_ID.source}`, 'g')],
    link: true
  },
  {
    type: FileType.Animation,
    regex: [new RegExp(`playanimation ${SELECTOR_REGEX_NO_GROUP.source} ${ANIMATION_MATCH.source}`, 'g')],
    link: false
  },
  {
    type: FileType.Dialogue,
    regex: [
      new RegExp(`dialogue open ${SELECTOR_REGEX_NO_GROUP.source} ${SELECTOR_REGEX_NO_GROUP.source} (${IDENTIFIER.source})`, 'g'),
      new RegExp(`dialogue change ${SELECTOR_REGEX_NO_GROUP.source} (${IDENTIFIER.source})`, 'g')
    ],
    link: false
  },
  {
    type: FileType.SoundEffect,
    regex: [
      new RegExp(`playsound ${RESOURCE_ID.source}`, 'g'),
      new RegExp(`stopsound ${SELECTOR_REGEX_NO_GROUP.source} ${RESOURCE_ID.source}`, 'g')
    ],
    link: false
  },
]

const SELECTOR_PATTERNS: SupportedUsageType[] = [
  { type: FileType.ServerEntityIdentifier, prefix: 'type', regex: [RESOURCE_ID], link: false }
]

class LineParser {
  private line: vscode.TextLine
  private lineContent: string
  private lineStartIndex: number
  private usageStore = new UsageStore()

  // Expose for compatibility
  get usages() {
    return this.usageStore.toMap()
  }

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
    return this.usageStore.getAtPosition(cursorPosition)
  }

  /**
   * Verify that the line is not a comment of sorts
   */
  private isValidLine () {
    return !(this.lineContent.startsWith('#') || this.lineContent.startsWith('//') || this.lineContent.startsWith('*'))
  }

  /**
   * Extract all command usages from the line
   */
  private extractCommandCalls () {
    for (const pattern of COMMAND_PATTERNS) {
      for (const regex of pattern.regex) {
        const matches = this.lineContent.matchAll(regex)

        for (const match of matches) {
          if (match && match.length === 2 && match.index !== undefined) {
            const [command, id] = match

            // remove the id from the command to get the index where the resource is used
            const commandPrefix = command.replace(id, '')

            // the index of the start of the command, and the length of the command before the resource
            const start = this.lineStartIndex + match.index + commandPrefix.length
            const range = new vscode.Range(
              new vscode.Position(this.line.lineNumber, start),
              new vscode.Position(this.line.lineNumber, start + id.length)
            )

            this.usageStore.add(pattern.type, id, range, pattern.link)
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
    for (const match of selectorMatches) {
      let selectorText = match[1]

      if (selectorText) {
        // remove a trailing quote if any, from a json file
        selectorText = removeEndingQuote(selectorText)
        this.parseSelector(selectorText, match.index!)
      }
    }
  }

  private parseSelector(input: string, startIndex: number) {
    let i = 0
    
    while (i < input.length) {
      // Skip whitespace
      while (i < input.length && /\s/.test(input[i])) i++
      
      if (i >= input.length || input[i] === ']') break
      
      // Parse key
      const keyStart = i
      while (i < input.length && input[i] !== '=' && !/\s/.test(input[i])) i++
      const key = input.substring(keyStart, i).trim()
      
      // Skip whitespace and '='
      while (i < input.length && (input[i] === '=' || /\s/.test(input[i]))) i++
      
      // Parse value
      const valueStart = i
      let valueEnd = i
      
      if (key === 'scores' || key === 'hasitem') {
        // Handle nested structures
        if (input[i] === '{') {
          let braceCount = 1
          i++
          while (i < input.length && braceCount > 0) {
            if (input[i] === '{') braceCount++
            else if (input[i] === '}') braceCount--
            i++
          }
          valueEnd = i - 1
        }
      } else {
        // Regular value
        while (i < input.length && input[i] !== ',' && input[i] !== ']') i++
        valueEnd = i
      }
      
      // Process the key-value pair
      let value = input.substring(valueStart, valueEnd).trim()
      let actualValueStart = this.lineStartIndex + valueStart + startIndex
      
      // Handle negation
      if (value.startsWith('!')) {
        value = value.substring(1)
        actualValueStart++
      }
      
      // Check against supported selectors
      for (const pattern of SELECTOR_PATTERNS) {
        if (pattern.prefix === key && value.length > 0) {
          const isValid = pattern.regex.every(re => re.test(value))
          if (isValid) {
            const range = new vscode.Range(
              new vscode.Position(this.line.lineNumber, actualValueStart),
              new vscode.Position(this.line.lineNumber, actualValueStart + value.length)
            )
            this.usageStore.add(pattern.type, value, range, pattern.link)
          }
        }
      }
      
      // Skip comma
      if (i < input.length && input[i] === ',') i++
    }
  }
}

export default LineParser

// Export types for compatibility
export type Usage = Map<SupportedTypes, UsageData>
export type UsageData = Data<LineInfo[]>
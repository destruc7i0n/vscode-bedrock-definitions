import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { Data, FileType } from '../../handlers/FileHandler'
import { ResourceFile, DescriptionObject } from './ResourceFile'

import { getRangeFromPath } from '../../lib/util'

export interface DescriptionFileType {
  [key: string]: DescriptionObject
}

/**
 * Handles files where it follows a top-level key and
 * the identifier is in a description object, such as the entity file
 */
abstract class DescriptionBasedFile extends ResourceFile {
  public abstract type: FileType
  /**
   * The string of the root of this file, at the same level as format_version
   */
  protected abstract root: string

  extractIdentifiers (document: vscode.TextDocument, node: Node, content: DescriptionFileType): Data {
    let response: Data = new Map()

    if (content[this.root]) {
      const identifier = this.verifyDescriptionIdentifier(content[this.root])
      if (identifier) {
        const path = [ this.root ]

        const range = getRangeFromPath(node, path, document)
        if (range) {
          response.set(identifier, { range })
        }
      }
    }

    return response
  }
}

export default DescriptionBasedFile

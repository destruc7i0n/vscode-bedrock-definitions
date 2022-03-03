import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { Data } from '../../handlers/FileHandler'
import { ResourceFile } from './ResourceFile'

import { getRangeFromPath } from '../../lib/util'

/**
 * Handles files where there are keys being the identifier,
 * such as the < 1.12 geometry file
 */
abstract class KeyBasedFile extends ResourceFile {
  /**
   * Optional root of the file. Some have one, some don't...
   */
  protected abstract root: string | undefined

  extractIdentifiers (document: vscode.TextDocument, node: Node, content: any) {
    let response: Data = new Map()

    // if it has a root
    const hasRoot = this.root !== undefined
    if (hasRoot) content = content[this.root!]

    if (content) {
      const identifiers = Object.keys(content)

      for (let identifier of identifiers) {
        const path = hasRoot ? [this.root!] : []
        path.push(identifier)

        const range = getRangeFromPath(node, path, document)
        if (range) {
          response.set(identifier, { range })
        }
      }
    }

    return response
  }
}

export default KeyBasedFile

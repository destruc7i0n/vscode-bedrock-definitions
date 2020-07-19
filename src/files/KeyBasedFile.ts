import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { Data, FileType } from '../handlers/FileHandler'
import { ResourceFile } from './ResourceFile'

abstract class KeyBasedFile extends ResourceFile {
  protected abstract root: string | undefined

  extractIdentifiers (document: vscode.TextDocument, node: Node, content: any) {
    let response: Data = new Map()

    // if it has a root
    const hasRoot = this.root !== undefined
    if (hasRoot) content = content[this.root as string]

    if (content) {
      const identifiers = Object.keys(content)

      for (let identifier of identifiers) {
        const path = hasRoot ? [ this.root as string ] : []
        path.push(identifier)

        const range = this.getRangeFromPath(node, path, document)
        if (range) {
          response.set(identifier, { range })
        }
      }
    }

    return response
  }
}

export default KeyBasedFile

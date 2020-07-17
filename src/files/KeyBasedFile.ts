import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { FilesSearchResponse, FileType } from '../handlers/FileHandler'
import { ResourceFile } from './ResourceFile'

abstract class KeyBasedFile extends ResourceFile {
  protected abstract root: string | undefined

  extract (document: vscode.TextDocument, node: Node, content: any) {
    let response: FilesSearchResponse = { files: [], identifiers: [] }

    // if it has a root
    const hasRoot = this.root !== undefined
    if (hasRoot) content = content[this.root as string]

    if (content) {
      const identifiers = Object.keys(content)

      for (let identifier of identifiers) {
        const path = hasRoot ? [ this.root as string ] : []
        path.push(identifier)

        const fileData = this.getFileData(node, path, document, identifier)
        if (fileData) {
          response.files.push(fileData)
          response.identifiers.push(identifier)
        }
      }
    }

    return response
  }
}

export default KeyBasedFile

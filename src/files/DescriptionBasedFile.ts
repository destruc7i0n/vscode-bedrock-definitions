import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { FilesSearchResponse, FileType } from '../handlers/FileHandler'
import { ResourceFile, DescriptionObject } from './ResourceFile'

interface DescriptionFileType {
  [key: string]: DescriptionObject
}

abstract class DescriptionBasedFile extends ResourceFile {
  public abstract type: FileType
  protected abstract root: string

  extract (document: vscode.TextDocument, node: Node, content: DescriptionFileType) {
    let response: FilesSearchResponse = { files: [], identifiers: [] }

    if (content[this.root]) {
      const identifier = this.verifyDescriptionIdentifier(content[this.root])
      if (identifier) {
        const path = [ this.root ]

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

export default DescriptionBasedFile

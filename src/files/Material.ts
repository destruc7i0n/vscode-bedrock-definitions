import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class MaterialFile extends KeyBasedFile {
  type = FileType.Material
  static title = 'Material'
  root = 'materials'
  static glob = `**/materials/**/*.material`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default MaterialFile

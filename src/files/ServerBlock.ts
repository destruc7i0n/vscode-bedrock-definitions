import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './types/DescriptionBasedFile'

class ServerBlockFile extends DescriptionBasedFile {
  type = FileType.Block
  static title = 'Block'
  root = 'minecraft:block'
  static glob = `**/blocks/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default ServerBlockFile

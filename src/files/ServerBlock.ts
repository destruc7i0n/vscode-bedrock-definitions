import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

class ServerBlockFile extends DescriptionBasedFile {
  type = FileType.ClientEntityIdentifier
  static title = 'Block'
  root = 'minecraft:block'
  static glob = `**/blocks/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default ServerBlockFile

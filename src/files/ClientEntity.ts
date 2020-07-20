import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

class ClientEntityFile extends DescriptionBasedFile {
  type = FileType.ClientEntityIdentifier
  static title = 'Client Entity'
  root = 'minecraft:client_entity'
  static glob = `**/entity/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default ClientEntityFile

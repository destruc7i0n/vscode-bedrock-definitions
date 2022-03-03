import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './types/KeyBasedFile'

class RenderControllerFile extends KeyBasedFile {
  type = FileType.RenderController
  static title = 'Render Controller'
  root = 'render_controllers'
  static glob = `**/render_controllers/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default RenderControllerFile

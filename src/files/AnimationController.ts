import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class AnimationControllerFile extends KeyBasedFile {
  type = FileType.AnimationController
  static title = 'Animation Controller'
  root = 'animation_controllers'
  static glob = `**/animation_controllers/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default AnimationControllerFile

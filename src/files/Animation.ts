import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './types/KeyBasedFile'

class AnimationFile extends KeyBasedFile {
  type = FileType.Animation
  static title = 'Animation'
  root = 'animations'
  static glob = `**/animations/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default AnimationFile

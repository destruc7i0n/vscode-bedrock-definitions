import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class SoundEffectFile extends KeyBasedFile {
  type = FileType.SoundEffect
  static title = 'Sound Effect'
  root = undefined
  static glob = `**/sounds/sound_definitions.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default SoundEffectFile

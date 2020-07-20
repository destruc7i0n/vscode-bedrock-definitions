import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class SoundEffectFile extends KeyBasedFile {
  type = FileType.SoundEffect
  root: string | undefined = undefined
  static title = 'Sound Effect'
  static glob = `**/sounds/sound_definitions.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }

  /**
   * Check for the root key and update accordingly
   * @param document 
   * @param node 
   * @param content 
   */
  extractIdentifiers (document: vscode.TextDocument, node: Node, content: any) {
    const contentKeys = Object.keys(content)
    // newer format update key
    if (contentKeys.includes('sound_definitions') && contentKeys.includes('format_version')) this.root = 'sound_definitions'
    return super.extractIdentifiers(document, node, content)
  }
}

export default SoundEffectFile

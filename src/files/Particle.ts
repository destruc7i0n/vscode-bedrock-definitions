import * as vscode from 'vscode'

import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

class ParticleFile extends DescriptionBasedFile {
  type = FileType.Particle
  static title = 'Particle'
  root = 'particle_effect'
  static glob = `**/particles/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }
}

export default ParticleFile

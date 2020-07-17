import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class SoundEffectFile extends KeyBasedFile {
  type = FileType.SoundEffect
  root = undefined
  glob = `**/sounds/sound_definitions.json`
}

export default SoundEffectFile

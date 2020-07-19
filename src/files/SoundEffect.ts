import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class SoundEffectFile extends KeyBasedFile {
  type = FileType.SoundEffect
  title = 'Sound Effect'
  root = undefined
  glob = `**/sounds/sound_definitions.json`
}

export default SoundEffectFile

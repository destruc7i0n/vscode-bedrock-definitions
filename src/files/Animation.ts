import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class AnimationFile extends KeyBasedFile {
  type = FileType.Animation
  root = 'animations'
  glob = `**/animations/**/*.json`
}

export default AnimationFile

import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class MaterialFile extends KeyBasedFile {
  type = FileType.Material
  title = 'Material'
  root = 'materials'
  glob = `**/materials/**/*.material`
}

export default MaterialFile

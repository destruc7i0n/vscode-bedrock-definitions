import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

class ClientEntityFile extends DescriptionBasedFile {
  type = FileType.ClientEntityIdentifier
  root = 'minecraft:client_entity'
  glob = `**/entity/**/*.json`
}

export default ClientEntityFile

import { fetchHomeBootstrap } from '~/commerce/lib/commerce'

export async function homeLoader() {
  return fetchHomeBootstrap()
}

// Sustituto de @supabase/functions-js. PokeDoc no invoca Edge Functions
// desde el navegador: la única que hay (meta-social) la ejecuta Netlify
// en el borde, sin pasar por el cliente.
class FunctionsClient {
  constructor() {}
  setAuth() {}
  invoke() {
    return Promise.reject(new Error('PokeDoc no incluye el cliente de Edge Functions: se quitó del bundle porque no se usa.'))
  }
}
class FunctionsError extends Error {}
class FunctionsFetchError extends FunctionsError {}
class FunctionsRelayError extends FunctionsError {}
class FunctionsHttpError extends FunctionsError {}
const FunctionRegion = { Any: 'any' }
export { FunctionsClient, FunctionsError, FunctionsFetchError, FunctionsRelayError, FunctionsHttpError, FunctionRegion }

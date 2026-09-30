/**
 * Hermes does not provide DOMException. WebRTC / mediasoup code references it
 * (e.g. `new DOMException(...)`, `extends DOMException`, bare `DOMException == null`)
 * and crash with: Property 'DOMException' doesn't exist.
 */
export function installDOMExceptionPolyfill(): void {
  const g = globalThis as typeof globalThis & { DOMException?: typeof DOMException }
  if (typeof g.DOMException === 'function') return

  class DOMExceptionPolyfill extends Error {
    readonly name: string
    readonly code: number

    constructor(message = '', name = 'Error') {
      super(message)
      this.name = String(name || 'Error')
      this.code = nameToCode(this.name)
      Object.setPrototypeOf(this, new.target.prototype)
    }
  }

  Object.defineProperties(DOMExceptionPolyfill, {
    INDEX_SIZE_ERR: { value: 1 },
    DOMSTRING_SIZE_ERR: { value: 2 },
    HIERARCHY_REQUEST_ERR: { value: 3 },
    WRONG_DOCUMENT_ERR: { value: 4 },
    INVALID_CHARACTER_ERR: { value: 5 },
    NO_DATA_ALLOWED_ERR: { value: 6 },
    NO_MODIFICATION_ALLOWED_ERR: { value: 7 },
    NOT_FOUND_ERR: { value: 8 },
    NOT_SUPPORTED_ERR: { value: 9 },
    INUSE_ATTRIBUTE_ERR: { value: 10 },
    INVALID_STATE_ERR: { value: 11 },
    SYNTAX_ERR: { value: 12 },
    INVALID_MODIFICATION_ERR: { value: 13 },
    NAMESPACE_ERR: { value: 14 },
    INVALID_ACCESS_ERR: { value: 15 },
    VALIDATION_ERR: { value: 16 },
    TYPE_MISMATCH_ERR: { value: 17 },
    SECURITY_ERR: { value: 18 },
    NETWORK_ERR: { value: 19 },
    ABORT_ERR: { value: 20 },
    URL_MISMATCH_ERR: { value: 21 },
    QUOTA_EXCEEDED_ERR: { value: 22 },
    TIMEOUT_ERR: { value: 23 },
    INVALID_NODE_TYPE_ERR: { value: 24 },
    DATA_CLONE_ERR: { value: 25 },
  })

  g.DOMException = DOMExceptionPolyfill as unknown as typeof DOMException
}

function nameToCode(name: string): number {
  switch (name) {
    case 'IndexSizeError':
      return 1
    case 'HierarchyRequestError':
      return 3
    case 'WrongDocumentError':
      return 4
    case 'InvalidCharacterError':
      return 5
    case 'NoModificationAllowedError':
      return 7
    case 'NotFoundError':
      return 8
    case 'NotSupportedError':
      return 9
    case 'InUseAttributeError':
      return 10
    case 'InvalidStateError':
      return 11
    case 'SyntaxError':
      return 12
    case 'InvalidModificationError':
      return 13
    case 'NamespaceError':
      return 14
    case 'InvalidAccessError':
      return 15
    case 'TypeMismatchError':
      return 17
    case 'SecurityError':
      return 18
    case 'NetworkError':
      return 19
    case 'AbortError':
      return 20
    case 'URLMismatchError':
      return 21
    case 'QuotaExceededError':
      return 22
    case 'TimeoutError':
      return 23
    case 'InvalidNodeTypeError':
      return 24
    case 'DataCloneError':
      return 25
    default:
      return 0
  }
}

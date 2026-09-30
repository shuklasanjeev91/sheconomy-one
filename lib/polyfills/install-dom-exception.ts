/**
 * Side-effect entry for the DOMException polyfill.
 *
 * Libraries may evaluate `class … extends DOMException` at module scope, so the
 * global has to exist before those modules are *imported*.
 * A plain function call cannot get there first: ES import bindings hoist above
 * every statement in the importing file. Importing this module instead makes the
 * install part of the import sequence, so it runs before any import listed below it.
 */
import { installDOMExceptionPolyfill } from '~/lib/polyfills/dom-exception'

installDOMExceptionPolyfill()

/** Class for utility functions */
export default class Util {
  /**
   * Extend an array just like JQuery's extend.
   * @param {object} arguments Objects to be merged.
   * @return {object} Merged objects.
   */
  static extend() {
    for (let i = 1; i < arguments.length; i++) {
      for (let key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          if (typeof arguments[0][key] === 'object' && typeof arguments[i][key] === 'object') {
            this.extend(arguments[0][key], arguments[i][key]);
          }
          else {
            arguments[0][key] = arguments[i][key];
          }
        }
      }
    }
    return arguments[0];
  }

  /**
   * Retrieve true string from HTML encoded string.
   * @param {string} input Input string.
   * @return {string} Output string.
   */
  static htmlDecode(input) {
    const dparser = new DOMParser().parseFromString(input, 'text/html');
    return dparser.documentElement.textContent;
  }

  /**
   * Wait for child object to be available.
   * @param {object} parent Parent who is waiting for a child.
   * @param {string} childName Child's name.
   * @param {function} callback Callback function.
   * @param {number} [timeout=200] Timeout between calls for child.
   * @param {number} [repeat=50] Number of calls for child.
   */
  static waitForChild(parent, childName, callback, timeout = 200, repeat = 50) {
    if (
      typeof parent !== 'object' ||
      typeof childName !== 'string' ||
      typeof callback !== 'function'
    ) {
      return;
    }

    if (parent[childName] !== undefined) {
      callback();
      return; // Child is found
    }

    // Limit callback timeout to 100ms
    timeout = Math.max(100, timeout);

    if (repeat < 0) {
      return; // No more tries
    }

    // Try again after timeout.
    setTimeout(() => {
      Util.waitForChild(parent, childName, callback, timeout, repeat - 1);
    }, timeout);
  }
}

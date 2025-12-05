module.exports = {
  /**
   * Minimal CommonJS implementation of `until-async` for Jest environments that
   * cannot import the ESM-only upstream package.
   *
   * @param {() => Promise<any>} callback
   * @returns {Promise<[Error|null, any|null]>}
   */
  until: async (callback) => {
    try {
      const result = await callback();
      return [null, result];
    } catch (error) {
      return [error, null];
    }
  },
};


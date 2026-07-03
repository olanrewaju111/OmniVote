/* Leaflet default icon webpack bundling fix */
declare module 'leaflet' {
  namespace Icon {
    namespace Default {
      // Allow deletion of _getIconUrl on the prototype for bundler icon path fix
      const prototype: {
        _getIconUrl?: string;
        [key: string]: unknown;
      };
    }
  }
}
// Dev build. Swapped in for environment.ts by the `dev` Angular configuration
// (see angular.json). Points the app at the dev backend behind Traefik.
export const environment = {
  production: false,
  apiUrl: 'https://apidev.crmbento.com/api/v1',
};

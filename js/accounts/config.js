// Neutralized for offline-first local media ecosystem
export const client = {
    setEndpoint: () => client,
    setProject: () => client,
};
export const auth = {
    get: async () => null,
    createSession: async () => {},
    deleteSession: async () => {},
    createEmailPasswordSession: async () => {},
    createOAuth2Session: () => {},
};

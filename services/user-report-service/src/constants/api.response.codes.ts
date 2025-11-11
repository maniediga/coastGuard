export enum HTTP_RESPONSE_CODE {
    NOT_FOUND = 404, // resource not found
    CREATED = 201,
    CONFLICT = 409, // update not possible due to conflict with existing state of db
    BAD_REQUEST = 400, // wrong requests e.g: wrong datatype, required params not provided
    SUCCESS = 200,
    UNAUTHORIZED = 401, // user is not authorized to req a resource, e.g: making get something req without logging in
    FORBIDDEN = 403,
    SERVER_ERROR = 500 // unknown server error
}

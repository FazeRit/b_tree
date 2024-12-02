class ApiError extends Error {
    status: number;
    errors: unknown[];

    constructor(status: number, message: string, errors: unknown[] = []) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.status = status;
        this.errors = errors;
    }

    static BadRequestError(message: string, errors: any[] = []) {
        return new ApiError(400, message, errors);
    }
}

export {ApiError};
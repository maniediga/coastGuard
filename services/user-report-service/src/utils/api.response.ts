export class ApiResponse {
    message: string;
    data: any;

    constructor(data = {}, message = "Wow, such empty.") {
        this.data = data;
        this.message = message;
    }
}

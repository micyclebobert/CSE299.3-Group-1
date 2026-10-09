class Matrix {
    constructor(data) {
        this.data = data;
        this.rows = data.length;
        this.cols = data[0].length;
    }

    static add(a, b) {
        if (a.rows !== b.rows || a.cols !== b.cols) {
            throw new Error("Matrices must have the same dimensions for addition");
        }
        const result = [];
        for (let i = 0; i < a.rows; i++) {
            const row = [];
            for (let j = 0; j < a.cols; j++) {
                row.push(a.data[i][j] + b.data[i][j]);
            }
            result.push(row);
        }
        return new Matrix(result);
    }

    static sub(a, b) {
        if (a.rows !== b.rows || a.cols !== b.cols) {
            throw new Error("Matrices must have the same dimensions for subtraction");
        }
        const result = [];
        for (let i = 0; i < a.rows; i++) {
            const row = [];
            for (let j = 0; j < a.cols; j++) {
                row.push(a.data[i][j] - b.data[i][j]);
            }
            result.push(row);
        }
        return new Matrix(result);
    }

    static scalar(matrix, scalar) {
        const result = [];
        for (let i = 0; i < matrix.rows; i++) {
            const row = [];
            for (let j = 0; j < matrix.cols; j++) {
                row.push(matrix.data[i][j] * scalar);
            }
            result.push(row);
        }
        return new Matrix(result);
    }

    static vector(matrix, vector) {
        if (matrix.cols !== vector.length) {
            throw new Error("Matrix columns must match vector length");
        }
        const result = [];
        for (let i = 0; i < matrix.rows; i++) {
            let sum = 0;
            for (let j = 0; j < matrix.cols; j++) {
                sum += matrix.data[i][j] * vector[j];
            }
            result.push(sum);
        }
        return result;
    }

    add(other) {
        return Matrix.add(this, other);
    }

    sub(other) {
        return Matrix.sub(this, other);
    }

    scalar(scalar) {
        return Matrix.scalar(this, scalar);
    }

    vector(vector) {
        return Matrix.vector(this, vector);
    }
}

module.exports = Matrix;

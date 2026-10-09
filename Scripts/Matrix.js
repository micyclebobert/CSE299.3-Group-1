const Complex = require("./Complex");

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
                row.push(a.data[i][j].add(b.data[i][j]));
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
                row.push(a.data[i][j].sub(b.data[i][j]));
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
                row.push(matrix.data[i][j].multiply(scalar));
            }
            result.push(row);
        }
        return new Matrix(result);
    }

    static multiply(a, b) {
        if (a.cols !== b.rows) {
            throw new Error("Matrix A columns must equal Matrix B rows");
        }
        const result = [];
        for (let i = 0; i < a.rows; i++) {
            const row = [];
            for (let j = 0; j < b.cols; j++) {
                let sum = new Complex(0, 0);
                for (let k = 0; k < a.cols; k++) {
                    sum = sum.add(a.data[i][k].multiply(b.data[k][j]));
                }
                row.push(sum);
            }
            result.push(row);
        }
        return new Matrix(result);
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

    multiply(other) {
        return Matrix.multiply(this, other);
    }
}

module.exports = Matrix;

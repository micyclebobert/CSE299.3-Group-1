import { Complex } from './Complex.js';

export class Matrix {
    constructor(data) {
        this.data = data;
        this.rows = data.length;
        this.cols = data[0].length;
    }

    static zeros(rows, cols) {
        const result = [];
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < cols; j++) {
                row.push(new Complex(0, 0));
            }
            result.push(row);
        }
        return new Matrix(result);
    }

    static identity(n) {
        const result = [];
        for (let i = 0; i < n; i++) {
            const row = [];
            for (let j = 0; j < n; j++) {
                row.push(i === j ? new Complex(1, 0) : new Complex(0, 0));
            }
            result.push(row);
        }
        return new Matrix(result);
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

    conjugateTranspose() {
        const result = [];
        for (let i = 0; i < this.rows; i++) {
            const row = [];
            for (let j = 0; j < this.cols; j++) {
                row.push(this.data[j][i].conjugate());
            }
            result.push(row);
        }
        return new Matrix(result);
    }

    frobeniusNormSquared() {
        let sum = 0;
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                sum += this.data[i][j].magnitudeSquared();
            }
        }
        return sum;
    }

    static isUnitary(matrix, tolerance = 1e-12) {
        const n = matrix.rows;
        const dagger = matrix.conjugateTranspose();
        const product = Matrix.multiply(dagger, matrix);
        const diff = Matrix.sub(product, Matrix.identity(n));
        return diff.frobeniusNormSquared() < tolerance;
    }

    static tensorProduct(a, b) {
        const result = [];
        for (let i = 0; i < a.rows; i++) {
            for (let k = 0; k < b.rows; k++) {
                const row = [];
                for (let j = 0; j < a.cols; j++) {
                    for (let l = 0; l < b.cols; l++) {
                        row.push(a.data[i][j].multiply(b.data[k][l]));
                    }
                }
                result.push(row);
            }
        }
        return new Matrix(result);
    }
}

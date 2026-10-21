class Complex {
    constructor(real, imaginary = 0) {
        this.real = real;
        this.imaginary = imaginary;
    }

    static from(value) {
        if (value instanceof Complex) {
            return value;
        }
        if (typeof value === "number") {
            return new Complex(value);
        }
        throw new TypeError("Value must be a number or a Complex instance");
    }

    static fromPolar(magnitude, phase) {
        return new Complex(
            magnitude * Math.cos(phase),
            magnitude * Math.sin(phase)
        );
    }

    add(other) {
        other = Complex.from(other);
        return new Complex(
            this.real + other.real,
            this.imaginary + other.imaginary
        );
    }

    sub(other) {
        other = Complex.from(other);
        return new Complex(
            this.real - other.real,
            this.imaginary - other.imaginary
        );
    }

    subtract(other) {
        return this.sub(other);
    }

    multiply(other) {
        other = Complex.from(other);
        return new Complex(
            this.real * other.real - this.imaginary * other.imaginary,
            this.real * other.imaginary + this.imaginary * other.real
        );
    }

    scale(scalar) {
        if (typeof scalar !== "number") {
            throw new TypeError("Scalar must be a number");
        }
        return new Complex(this.real * scalar, this.imaginary * scalar);
    }

    divide(other) {
        other = Complex.from(other);
        const denominator = other.magnitudeSquared();
        if (denominator === 0) {
            throw new RangeError("Cannot divide by zero");
        }
        return new Complex(
            (this.real * other.real + this.imaginary * other.imaginary) / denominator,
            (this.imaginary * other.real - this.real * other.imaginary) / denominator
        );
    }

    conjugate() {
        return new Complex(this.real, -this.imaginary);
    }

    magnitudeSquared() {
        return this.real * this.real + this.imaginary * this.imaginary;
    }

    magnitude() {
        return Math.hypot(this.real, this.imaginary);
    }

    phase() {
        return Math.atan2(this.imaginary, this.real);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = Complex;
}
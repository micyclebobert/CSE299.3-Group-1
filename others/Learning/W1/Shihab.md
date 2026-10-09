**Date: 09/10/2026**

1. This report documents the design, mathematical foundations, and programmatic implementation
of an object-oriented Complex number arithmetic class in JavaScript. 
A complex number extends the one-dimensional real coordinate system into a two-dimensional
plane (the complex plane, or Argand diagram), structured as:
$$z = a + bi \quad \text{where } a, b \in \mathbb{R} \text{ and } i^2 = -1$$

The implementation encapsulates state, coordinate transformations, fundamental arithmetic 
operations, and conjugate-based division.


2. A complex value $z$ can be represented in either Cartesian (Rectangular) or Polar coordinates.

![Complex Plane Argand Diagram](./complex_plane.png)

For polar to cartesian coordinate transformation:
* **Transformation Equations:**

  $$a = r \cos(\theta)$$

  $$b = r \sin(\theta)$$

* **Final Cartesian Form:**

  $$z = r \cos(\theta) + i \big(r \sin(\theta)\big) = a + bi$$

For cartesian to polar coordinate transformation:
* **Modulus Squared ($r^2$):**

  $$|z|^2 = a^2 + b^2$$

* **Modulus / Magnitude ($r$):**

  $$|z| = \sqrt{a^2 + b^2}$$

* **Phase / Argument ($\theta$):**

  $$\theta = \operatorname{atan2}(b, a) \in (-\pi, \pi]$$



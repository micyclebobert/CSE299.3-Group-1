# Project Learning & Work Updates

This log is meant to record my daily learnings, project progress, tasks completed, and next steps. I will start with today and continue each day.

---

## Today - 2026-10-06

### Learning / Insights
- What I learned today about the project, technology, research, or workflow:

Before getting into the realization of how the quantum circuit simulation will end up working I have to have the understanding of basics of quantum computing and some of the postulates of quantum mechanics.

Starting at the very basics: What exactly is a qubit? Well I learned that just how the regular bit of 1 and 0 is a representation of the most fundamental unit of information in classical computing (comes from classical mechanics and quantum mechanics) the qubit is the most basic representation of information in quantum computing. What exaclty is a qubit then is actually pretty difficult to define. In classical computing, we define the state of 1 and the state of 0 using different standards. We use transistors or capacitors charged to a certain voltage to represent the state of 1 and discharged to represent the state of 0. But that is because a regular bit can exist in only 2 logical states. When we are talking about quantum bits, we follow one of the postulates of quantum mechanics. 

The thing is, when we deal with nature in the macroscopic world, classical Newtonian mechanics dominates the functions and movements of our world. These mathematical frameworks help represent the macroscopic world around us. When we get into the atomic or subatomic scale, thats when the laws of quantum mechanics comes to dominate. The classical world and our intuition surrounding it collapses and we face unintuitive realities. Qubits or Quantum bits, following the rules of quantum mechanics are representations of quantum states. Any quantum object in quantum mechanics is defined by a wave. This is important because we can follow through and draw our understanding from how waves work and their properties. As I have mentioned, we represent individual qubits as quantum objects which are defined by a wave. Mathematically, we define waves in quantum mechanics using complex numbers since only the use of real numbers gives us a myopic view of the state and behaviour of the quantum system and its evolution. The postulate of quantum mechanics that I mentioned in the previous paragraph is called superposition. What is this exactly? Superposition is a property of quantum systems. It says that if a system has fixed definite states, before measurement the system exists in all the possible states at the same time. This is strange and unintuitive since its like saying that I have a bit and its value is both 0 and 1. I have a proposition that is both true and false. Its different than that. The concept of superposition is better understood when we delve into how we represent it using math. 

We represent it using the concept of linear combination in linear algebra. First to introduce the notations used in quantum computation: |> This is called the ket notation. We use this to represent any quantum state. For example: |0> represents the zero quantum state which is basically 0 of the regular bit and naturally the |1> represents the 1 state. |psi> = alpha|0> + beta|1>. This is our mathematical definition of a regular qubit. Here alpha and beta are complex numbers and are called amplitudes. There is this concept called the Born rule which states that the square of the amplitude gives us the probability of finding the qubit in the state the amplitude is associated with after measurement. Since the total probability is equal to one, the sum of the square of alpha and the square of beta gives us 1. This is how we represent or try to understand a qubit. Now one might ask what is the benefit of doing any of this atall. What are we getting out of our bit existing in a superposition of multiple states rather than using our regular bits in classical computation. Well the thing is, when we run computations using quantum computers, our system stays in a superposition of multiple states. Out of all the states, one of the states is the correct one or the one we are looking for. We can manipulate our system using the concepts of Constructive interference and Destructive interference (from wave behaiviour) to reduce the probabilities of the system coming up with the wrong outputs and increase the probability of it coming up with the intended one. This helps us in a way have done massive parallel computation. In classical computers we would have to perform computations one after another to find the correct answer, where in the case of quantum computers we have them explored in one go in the state of superposition. There is a lot more I learned but I will share another day. 
 

### Work Completed
- Tasks or work I finished today:
- Not exactly today, we initialized the project repo with a Readme file and the requirements text file. 
- Initialized the filestructure to be followed in the project. (subject to change)
- 

### Project Updates
- Key updates regarding the project or development progress:
- Nothing key yet simple repo initialization
- 

### Challenges / Blockers
- Issues I faced or questions I need to solve:
- nothing yet
- 

### Next Steps
- What I plan to do next:
- The goal is to start building from the core mechanics. First to represent our basic tools, such as complex numbers, and matrices. Then we move onto higher levels of abstractions.
- 

---

## [Date]

### Learning / Insights
- 
- 

### Work Completed
- 
- 

### Project Updates
- 
- 

### Challenges / Blockers
- 
- 

### Next Steps
- 
- 

---

## [Date]

### Learning / Insights
- 
- 

### Work Completed
- 
- 

### Project Updates
- 
- 

### Challenges / Blockers
- 
- 

### Next Steps
- 
- 

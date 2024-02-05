---
layout: page
title: Collaborative Filtering
description: Implemented an efficient algorithm for collaborative filtering and used it to recommend movies to users based on their ratings.   
img: assets/img/Projects/collaborative_filtering/thumbnail.png
importance: 1
category: ML Projects
---

## The Coding
All the code was written in Python without using any of the pre-existing ML libraries such as tensorflow, sklearn, etc. The code can be found on my [GitHub](https://github.com/petrichor1998/CollaborativeFilteringProject). The following are the highlights of the code:
1. Implemented the collaborative filtering algorithm as described in the [original paper](https://arxiv.org/abs/1301.7363) by Breese et al.
2. Evaluated on the Netflix dataset.

## The Experiments
The major challenge in implementing the algorithm was the runtime. Only using pyhton and for loops the time taken was approximately a day. I had to use numpy's efficient vectorization to reduce the runtime. The runtime of the algorithm was reduced to **15 mins**.

**Total runtime : 15 mins**

**Mean absolute error = 0.773**

**RMS error = 2.875**


## The Learnings
I like to categorize my learnings into two categories: The Profound and The Subtle.
The Profound are the key questions that were answered through this project. The Subtle could be an intuition I had, insight I discovered or a clever python hack I learnt from this project. For example, `print` statement has a parameter called `end` which can be used to change the default newline character to something else. 

### The Profound

**Q1. What can we say about the mean absolute error ?**

The mean absolute error is less which signifies that the algorithm gives a good prediction but the variance
is very high which is signified by the high RMS error.

### The Subtle

1. Numpy gives a super fast runtime. The vectorization of the code was very easy. It is a little difficult to get your head aorund the vectorization but once you do, it is very easy to implement.

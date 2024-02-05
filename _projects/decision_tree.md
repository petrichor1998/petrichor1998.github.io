---
layout: page
title: A Deep Dive into Decision Trees and Random Forests
description: Coding a decision tree and a random forest classifier from scratch and analyzing the performance of the classifiers on different datasets.   
img: assets/img/project_thumbnails/d_tree.jpg
importance: 1
category: ML Projects
---

## The Coding
All the code was written in Python without using any of the pre-existing ML libraries such as tensorflow, sklearn, etc. The code can be found on my [github](https://github.com/petrichor1998/DecisionTreeProject). The following are the highlights of the code:
1. Implemented the decision tree algorithm with information gain heuristic and the Variance Impurity heuristic.
2. Implemented the reduced error pruning and the depth based pruning to prune the decision tree.
3. Implemented the random forest algorithm.

## The Experiments
15 datasets were generated synthetically by randomly sampling solutions and non-solutions (with solutions having class “1” and nonsolutions having class “0”) from a Boolean formula in conjunctive normal form (CNF). I randomly generated five formulas having 500 variables and 300, 500, 1000, 1500 and 1800 clauses (where the length
of each clause equals 3) respectively and sampled 100, 1000 and 5000
positive and negative examples from each formula.

The decision tree and random forest classifiers were trained and tested on these datasets. 

## The Learnings
I like to categorize my learnings into two categories: The Profound and The Nitty-Gritty.
The Profound are the key questions that were answered through this project. The Nitty-Gritty are some of the nitty gritty details I learnt from this project. The nitty-gritty learnings could be as subtle as printing finding out that the `print` statement has a parameter called `end` which can be used to change the default newline character to something else. 
### The Profound

**Q1. Which impurity heuristic (Entropy/Variance) yields the best classification accuracy?
How does increasing the number of examples and/or the number of clauses impact the (accuracy of the) two impurity heuristics.**

The entropy heuristic seems to give slightly better accuracy on these datasets. The accuracy for both the techniques seems to increase as the number of clauses and training data increases. However, in practice, the heuristic does not significantly impact the accuracy of the decision tree.

**Q2. Which overfitting avoidance method (reduced error pruning/ depth-based pruning) yields the best accuracy? Again, how does increasing the number of examples and/or the number of clauses impact the (accuracy of the) two overfitting avoidance methods.**

The reduced error pruning is a better method according to the data because it removes one node at a time and there is better chance of finding a combination of nodes that when removed yield a better accuracy. Whereas in depth-based pruning, all the nodes at a particular level are pruned which seems inefficient for a given list of depths to choose the hyperparameter from. As the number of examples increase the accuracy increases. 
As the number of clauses increase, the accuracy of both the pruning seem to increase more the number of clauses means there are more branches that the data can be classified into and which results into more purity. The naïve tree is classifying better as the clauses increases.

**Q3. Are random forests much better in terms of classification accuracy than decision tree learners? Why?**

The random forest classifiers are much better than the decision tree classifiers because they are essentially a combination of a number of decision trees that compute the class of an instance and then vote on the best classification.

**Q4. How does the number of trees in the random forest impact the classification accuracy?**

The accuracy of the random forest increases as the number of trees in the forest increases. However, the increase in accuracy is not significant after a certain number of trees.

### The Subtle

1. Python makes implementing algorithms very easy and the code is very readable. I was able to code the decision tree algorithm without much difficulty.
2. The libraries that are implemented in sklearn are also done by people like me. I looked at the source code for the decision tree classifier in sklearn after the project and it was very insightful.
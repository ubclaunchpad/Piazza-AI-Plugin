
#run "pip install piazza-api" to get the Piazza import

from piazza_api import Piazza
p = Piazza()


#Log in to access the user's courses
p.user_login("email", "password")


user_profile = p.get_user_profile()


#p.get_user_profile().get('all_classes').get('mebo7f6nbjr6i5')

#Gets the authenticated user's classes and returns a list of dicts.


courses = p.get_user_classes()
print('\n')

for course in courses:
    print(course.get("name"),course.get("nid"))

# nid: course id, used to grab the contents of the class 
# name: course name

#Gets the piazza course with the given ID
cpsc221 = p.network("mebo7f6nbjr6i5")



#Gets x amount of posts in the class

posts = cpsc221.iter_all_posts(limit = 4)

for post in posts:
    print(post.get("history")[0].get("content"), post.get("history")[0].get("subject"))
    print("\n")


#posts important keys
# id:
# history: 
# history.subject: TItle
# history.content: the content of the post
# history.created: when it was created
# created: date created
# children: replies to the post


import User

#Construct a user with csrf_token and piazza_session
user = User.User("f7cfbe6c26b0a00dc0d4c3b48f2ddfa90f7e9f4c15a9182e", "2.eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzM4NCJ9.eyJuYmYiOjE3NjM3OTM2MTMsImRhdGEiOnsiZXhwaXJlcyI6MTc2NTAwMzIxMywicGVybSI6IjAiLCJsb2dnaW5nX2luIjp0cnVlLCJjcmVhdGVkX2F0IjoxNzYzNzkzNjEzLCJ3aGVuIjoxNzYzNzkzNjEzLCJob21lIjoiLyIsInJlbWVtYmVyIjoib24iLCJzZXNzaW9uX3Rva2VuIjoic3RfZnJQYTFPWnQvQjF1NFY0MGtDdm8iLCJuaWRzIjoibWNueWkxY2dxaDg1c2s6MDtsbHZsczFlZzkwcDc2dzowO2xsd3c5OHl1Z3QzM3h6OjA7bG0xN2QxeHg4bjMzcWc6MDtscDh4Z2tvbTViZHNkOjA7bHF3cmQ1NmE5NGs1N3o6MDtscjB3Znh5NXg3djI3aTowO2xxd2t0Z21pa2gyNWo0OjA7bTA1bWhtOG0ycnk0MGI6MDttMDFnMjJ2cDJkMTFybjowO20wZTVtenczY2FqMWplOjA7bTR0aXRocWZkY2E3YWc6MDttNW82YjM1MHUzaTJiazowO201a25xY3ZhdndkNTlsOjA7bTR1anAwczR4Z201bzU6MDsiLCJ0YWciOiIiLCJ1c2VyIjoibG03Y3R1ZWdjMjQxN2EiLCJlbWFpbCI6ImhhbWluMDRAc3R1ZGVudC51YmMuY2EifSwiaXNzIjoicGlhenphLmNvbSIsImV4cCI6MTc2NTAwMzIxM30.WknjCoRXHuFBaJ9gwdif6GwQkJhrPvK80_0GH1OzM7LHCQrYKYceF8dv8NRwjXDPS0wWs1DzpRsoNZE_eSiy3Ey02QoIeEyUc7ReJczwOHyobDJ3xkffYQJOhla1bnMB")


print(user.getPosts(5,5, "mcnyi1cgqh85sk"))

#Format of a post
# {
#       "fol": "pa3|",
#       "m": 1762494100895,
#       "rq": 0,
#       "id": "mhocb2yvx1a283",
#       "unique_views": 78,
#       "score": 78.0,
#       "nid": "mebo7f6nbjr6i5",
#       "is_new": true,
#       "d-bucket": "Yesterday",
#       "bucket_name": "Yesterday",
#       "bucket_order": 4,
#       "folders": ["pa3"],
#       "nr": 475,
#       "main_version": 2,
#       "request_instructor": 0,
#       "log": [
#         { "t": "2025-11-07T04:12:50Z", "n": "create" },
#         { "t": "2025-11-07T05:41:40Z", "n": "followup" }
#       ],
#       "subject": "Possible Incorrect/Unclear instructions on PA3",
#       "no_answer_followup": 1,
#       "num_favorites": 0,
#       "type": "question",
#       "tags": ["pa3", "student", "unanswered"],
#       "gd_f": 0,
#       "content_snipet": "For tolerance 0.0 do we assume that each leaf is just a single pixel? I'm asking this because for ./testpa3 7 that seems",
#       "view_adjust": 0,
#       "no_answer": 1,
#       "modified": "2025-11-07T05:41:40Z",
#       "updated": "2025-11-07T04:12:50Z",
#       "status": "active"
#     },

#nr is the post number which can be used to get all the content from the post including replies, type ,etc



post = user.getPostContent(321,"mcnyi1cgqh85sk")


#IMPORTANT KEYS FOR POSTS
print(f"POST SUBJECT/TITLE : {post["history"][0]["subject"]} \n") #post["history"][0]["subject"] (the title of the post)
print(f"POST BODY: {post["history"][0]["content"]} \n") #post["history"][0]["content"] (the content / body of the post)
print(f"POST TYPE: {post["type"]} \n") #post type, ex question, note
print(f"POST REPLIES : {post["children"]} \n") #post["children"] Returns an array of replies
print(f"POST REPLY OF INDEX 0 : {post["children"][0]} \n") #post["children"][i] Returns the ith reply
print(f"TYPE OF POST REPLY OF INDEX 0 : {post["children"][0]["type"]} \n") #post["children"][i]["type"] Returns the type of reply of the ith reply ex, i_answer is the instructor's answer
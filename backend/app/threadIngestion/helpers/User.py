import requests
class User():

    #csrf_token: "session_id" found in the user's cookies in local storage
    #piazza_session: "piazza_session" found in the user's cookies in local storage
    #THESE ARE NEEDED IN THE HEADERS OF THE API REQUESTS

    def __init__(self, csrf_token, piazza_session):
        self.csrf_token = csrf_token
        self.piazza_session = piazza_session



    def setCSRF(csrf_token):
        self.csrf_token = csrf_token
    


    def setSession(piazza_session):
        self.piazza_session = piazza_session


    #offset: Posts in the piazza API are returned starting from pinned, then posts based on date, offset is the starting index of posts.
    #num: number of posts
    #network: the course id
    #returns num amount of posts in the chosen course
    def getPosts(self, offset, num, network):

        ref = f"https://piazza.com/class/{network}"

        #REQUIRED HEADERS TO MAKE A POST REQUEST TO THE PIAZZA API
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "Sec-Fetch-Site": "same-origin",
            "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Fetch-Mode": "cors",
            "Origin": "https://piazza.com",
            "Referer": ref,
            "Sec-Fetch-Dest": "empty",
            "Cookie": f"piazza_session={self.piazza_session}; session_id={self.csrf_token}",
            "CSRF-Token": self.csrf_token,
            "Priority": "u=3, i"
        }

        data = {
            "method": "network.get_my_feed",
            "params": {
            "nid": network,
            "offset": offset,
            "limit": num
            }
        }

        response = requests.post("https://piazza.com/logic/api?method=network.get_my_feed", headers=headers, json=data)
        print(response.status_code)
        return response.json()["result"]


    #post_num: used to identify the post, defined as "nr" when fetching posts in getPosts
    #network: course id
    def getPostContent(self,post_num, network):
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "Sec-Fetch-Site": "same-origin",
            "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Fetch-Mode": "cors",
            "Origin": "https://piazza.com",
            "Referer": f"https://piazza.com/class/{network}/post/{post_num}",
            "Sec-Fetch-Dest": "empty",
            "Cookie": f"piazza_session={self.piazza_session}; session_id={self.csrf_token}",
            "CSRF-Token": self.csrf_token,
            "Priority": "u=3, i"
        }

        payload = {
            "method": "content.get",
            "params": {
                "cid": f"{post_num}",
                "nid": network,
                "student_view": None
            }
        }

        response = requests.post("https://piazza.com/logic/api?method=content.get", headers=headers, json=payload)
        print(response.status_code)
        return response.json()["result"]




import json, urllib.request, urllib.error, http.cookiejar, uuid
base="http://localhost:5173"
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(path,data=None,expected=200,origin=base):
 req=urllib.request.Request(base+"/api/auth/"+path,data=json.dumps(data).encode() if data is not None else None,headers={"Content-Type":"application/json","Origin":origin})
 try:
  r=client.open(req); status=r.status; body=r.read()
 except urllib.error.HTTPError as e: status=e.code; body=e.read()
 assert status==expected,(path,status,body)
 return json.loads(body) if body else None
email="qa-"+uuid.uuid4().hex[:10]+"@example.com"
data={"name":"Prueba automatizada","email":email,"password":"PruebaSegura123!"}
call('me',expected=401)
call('register',{**data,'password':'short'},422)
u=call('register',data,201)
assert 'password_hash' not in u
call('register',data,409)
call('login',{**data,'password':'Incorrecta123'},401)
call('login',data,origin='http://otro-sitio.example',expected=403)
call('login',data)
assert call('me')['email']==email
assert any(c.name=='healthtrack_session' and c.has_nonstandard_attr('HttpOnly') for c in jar)
call('logout',{},204)
call('me',expected=401)
print('PASS: validación, registro, duplicado, contraseña incorrecta, origen, login, sesión y logout')

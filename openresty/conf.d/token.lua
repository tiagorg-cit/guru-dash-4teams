local res = ngx.location.capture('/fetch_api', { method = ngx.HTTP_GET, args = {token=ngx.queryParameter.token} });

ngx.log(ngx.ERR, res.status);
if res.status == ngx.HTTP_OK then
   ngx.var.api_result = res.body.token;
else
  ngx.exit(403);
end
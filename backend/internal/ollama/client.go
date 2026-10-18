package ollama

import (
 "bytes"
 "context"
 "encoding/base64"
 "encoding/json"
 "fmt"
 "io"
 "net/http"
 "strings"
 "time"
)
type Client struct{URL string;HTTP *http.Client}
func New(url string)*Client{return &Client{strings.TrimRight(url,"/"),&http.Client{Timeout:55*time.Second}}}
func(c *Client)Generate(ctx context.Context,model,prompt string,schema any,image []byte,out any)error{
 message:=map[string]any{"role":"user","content":prompt};if len(image)>0{message["images"]=[]string{base64.StdEncoding.EncodeToString(image)}}
 body,_:=json.Marshal(map[string]any{"model":model,"messages":[]any{message},"stream":false,"think":false,"format":schema,"options":map[string]any{"temperature":0,"num_ctx":4096,"num_predict":700},"keep_alive":"5m"})
 req,err:=http.NewRequestWithContext(ctx,"POST",c.URL+"/api/chat",bytes.NewReader(body));if err!=nil{return err};req.Header.Set("Content-Type","application/json")
 res,err:=c.HTTP.Do(req);if err!=nil{return fmt.Errorf("local model unavailable")};defer res.Body.Close();if res.StatusCode!=200{return fmt.Errorf("local model returned status %d",res.StatusCode)}
 var envelope struct{Message struct{Content string `json:"content"`} `json:"message"`};if err=json.NewDecoder(io.LimitReader(res.Body,1<<20)).Decode(&envelope);err!=nil{return fmt.Errorf("invalid model response")};if err=json.Unmarshal([]byte(envelope.Message.Content),out);err!=nil{return fmt.Errorf("model output did not match JSON schema")};return nil
}
func(c *Client)Models(ctx context.Context)([]string,error){ctx,cancel:=context.WithTimeout(ctx,2*time.Second);defer cancel();req,_:=http.NewRequestWithContext(ctx,"GET",c.URL+"/api/tags",nil);res,err:=c.HTTP.Do(req);if err!=nil{return nil,err};defer res.Body.Close();if res.StatusCode!=200{return nil,fmt.Errorf("model server not ready")};var data struct{Models []struct{Name string `json:"name"`} `json:"models"`};if err=json.NewDecoder(io.LimitReader(res.Body,1<<20)).Decode(&data);err!=nil{return nil,err};out:=[]string{};for _,m:=range data.Models{out=append(out,m.Name)};return out,nil}

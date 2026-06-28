package shopify

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ExchangeCodeForToken exchanges an OAuth code for an access token. The caller DISCARDS the token
// (this app is stateless and never stores it); it is returned only so the handler can confirm the
// handshake succeeded.
func ExchangeCodeForToken(shop, apiKey, apiSecret, code string) (string, error) {
	form := url.Values{}
	form.Set("client_id", apiKey)
	form.Set("client_secret", apiSecret)
	form.Set("code", code)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.PostForm("https://"+shop+"/admin/oauth/access_token", form)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", errors.New("token exchange returned " + resp.Status)
	}
	var body struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	if strings.TrimSpace(body.AccessToken) == "" {
		return "", errors.New("empty access token")
	}
	return body.AccessToken, nil
}

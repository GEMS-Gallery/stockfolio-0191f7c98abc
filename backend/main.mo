import Blob "mo:base/Blob";
import Int "mo:base/Int";
import Nat16 "mo:base/Nat16";
import Trie "mo:base/Trie";

import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import TrieMap "mo:base/TrieMap";
import Char "mo:base/Char";
import Nat32 "mo:base/Nat32";

actor {
  public type Asset = {
    id: Nat;
    symbol: Text;
    name: Text;
    quantity: Float;
    assetType: Text;
  };

  stable var assetsEntries : [(Nat, Asset)] = [];
  var assets = TrieMap.fromEntries<Nat, Asset>(assetsEntries.vals(), Nat.equal, Nat.hash);
  stable var nextId: Nat = 1;

  func assetToJSON(a: Asset): Text {
    "{\"id\":" # Nat.toText(a.id) # 
    ",\"symbol\":\"" # a.symbol # 
    "\",\"name\":\"" # a.name # 
    "\",\"quantity\":" # Float.toText(a.quantity) # 
    ",\"assetType\":\"" # a.assetType # "\"}";
  };

  func assetsToJSON(): Text {
    let jsonAssets = Array.map<Asset, Text>(
      Iter.toArray(assets.vals()),
      func (a: Asset): Text { assetToJSON(a) }
    );
    "[" # Text.join(",", jsonAssets.vals()) # "]";
  };

  public query func http_request(request: HttpRequest) : async HttpResponse {
    let path = Iter.toArray(Text.tokens(request.url, #text("/")));
    
    switch (request.method, path) {
      case ("GET", path) {
        if (path.size() == 2 and path[0] == "api" and path[1] == "assets") {
          return {
            status_code = 200;
            headers = [("Content-Type", "application/json")];
            body = Text.encodeUtf8(assetsToJSON());
          };
        } else {
          return notFound();
        };
      };
      case ("POST", path) {
        if (path.size() == 2 and path[0] == "api" and path[1] == "assets") {
          let assetData = switch (Text.decodeUtf8(request.body)) {
            case (null) { return badRequest("Invalid body encoding"); };
            case (?t) { t };
          };
          
          let newAsset = switch (parseAsset(assetData)) {
            case (null) { return badRequest("Invalid asset data"); };
            case (?asset) { asset };
          };
          
          let id = nextId;
          nextId += 1;
          assets.put(id, { id = id; symbol = newAsset.symbol; name = newAsset.name; quantity = newAsset.quantity; assetType = newAsset.assetType });
          
          return {
            status_code = 201;
            headers = [("Content-Type", "application/json")];
            body = Text.encodeUtf8(
              switch (assets.get(id)) {
                case (null) { "{\"error\": \"Asset not found\"}" };
                case (?asset) { assetToJSON(asset) };
              }
            );
          };
        } else {
          return notFound();
        };
      };
      case _ { return notFound(); };
    };
  };

  func parseAsset(jsonStr: Text) : ?Asset {
    let fields = Iter.toArray(Text.split(jsonStr, #text(",")));
    var symbol: ?Text = null;
    var name: ?Text = null;
    var quantity: ?Float = null;
    var assetType: ?Text = null;

    for (field in fields.vals()) {
      let kv = Iter.toArray(Text.split(field, #text(":")));
      if (kv.size() == 2) {
        let key = Text.trim(kv[0], #text("\" "));
        let value = Text.trim(kv[1], #text("\" "));
        switch (key) {
          case "symbol" { symbol := ?value };
          case "name" { name := ?value };
          case "quantity" { quantity := textToFloat(value) };
          case "assetType" { assetType := ?value };
          case _ {};
        };
      };
    };

    switch (symbol, name, quantity, assetType) {
      case (?s, ?n, ?q, ?t) {
        ?{
          id = 0; // Will be set when adding to assets
          symbol = s;
          name = n;
          quantity = q;
          assetType = t;
        };
      };
      case _ { null };
    };
  };

  func textToFloat(t : Text) : ?Float {
    var i = 0;
    var f : Float = 0;
    var isNegative = false;
    var decimalPlace = 0;

    for (c in t.chars()) {
      if (i == 0 and c == '-') {
        isNegative := true;
      } else if (c == '.') {
        decimalPlace := 1;
      } else if (c >= '0' and c <= '9') {
        let digit = Float.fromInt(Nat32.toNat(Char.toNat32(c) - 48));
        if (decimalPlace == 0) {
          f := f * 10 + digit;
        } else {
          f := f + digit / Float.pow(10, Float.fromInt(decimalPlace));
          decimalPlace += 1;
        };
      } else {
        return null; // Invalid character
      };
      i += 1;
    };

    if (isNegative) {
      ?(-f)
    } else {
      ?f
    };
  };

  func badRequest(message: Text) : HttpResponse {
    {
      status_code = 400;
      headers = [("Content-Type", "application/json")];
      body = Text.encodeUtf8("{\"error\": \"" # message # "\"}");
    };
  };

  func notFound() : HttpResponse {
    {
      status_code = 404;
      headers = [("Content-Type", "application/json")];
      body = Text.encodeUtf8("{\"error\": \"Not Found\"}");
    };
  };

  type HttpRequest = {
    method: Text;
    url: Text;
    headers: [(Text, Text)];
    body: Blob;
  };

  type HttpResponse = {
    status_code: Nat16;
    headers: [(Text, Text)];
    body: Blob;
  };

  system func preupgrade() {
    assetsEntries := Iter.toArray(assets.entries());
  };

  system func postupgrade() {
    assets := TrieMap.fromEntries(assetsEntries.vals(), Nat.equal, Nat.hash);
    assetsEntries := [];
  };
}